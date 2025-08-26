import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Create Supabase client using the service role key for database updates
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    logStep("Session ID received", { sessionId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { 
      paymentStatus: session.payment_status,
      customerId: session.customer,
      metadata: session.metadata 
    });

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Payment not completed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userId = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits || "0");

    if (!userId || !credits) {
      throw new Error("Invalid session metadata");
    }

    logStep("Processing payment", { userId, credits });

    // Use the secure RPC function to update credits and create records
    const { data: updateSuccess, error: rpcError } = await supabaseClient.rpc(
      'update_credits_after_payment',
      {
        p_user_id: userId,
        p_credits: credits,
        p_description: `Compra de ${credits} créditos via Stripe`
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

    logStep("Payment processed successfully", { userId, credits });

    return new Response(JSON.stringify({ 
      success: true, 
      credits: credits,
      message: "Payment verified and credits added"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});