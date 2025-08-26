import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Adsterra API configuration
const ADSTERRA_API_BASE = 'https://api3.adsterratools.com/publisher';
const ADSTERRA_TOKEN = Deno.env.get('ADSTERRA_API_TOKEN'); // 731e9effc9eb1b203fa64a84e4e69007

interface AdsterraPlacement {
  id: number;
  domain_id: number;
  title: string;
  alias: string;
  direct_url?: string;
}

interface AdsterraStats {
  date: string;
  impression: number;
  clicks: number;
  ctr: number;
  cpm: number;
  revenue: number;
}

// Lista de vídeos de anúncio curtos otimizados (15-30 segundos)
const SHORT_AD_VIDEOS = [
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: 30,
    title: "Anúncio Interativo",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", 
    duration: 25,
    title: "Oferta Especial",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg"
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 15,
    title: "Promoção Limitada", 
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg"
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: 20,
    title: "Desconto Exclusivo",
    thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg"
  }
];

async function makeAdsterraRequest(endpoint: string, params?: Record<string, string>) {
  if (!ADSTERRA_TOKEN) {
    throw new Error('Adsterra API token not configured');
  }

  const url = new URL(`${ADSTERRA_API_BASE}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': ADSTERRA_TOKEN,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Adsterra API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function getDomains() {
  try {
    const data = await makeAdsterraRequest('domains.json');
    return { success: true, data: data.items || [] };
  } catch (error) {
    console.error('Error fetching Adsterra domains:', error);
    return { success: false, error: error.message };
  }
}

async function getPlacements() {
  try {
    const data = await makeAdsterraRequest('placements.json');
    return { success: true, data: data.items || [] };
  } catch (error) {
    console.error('Error fetching Adsterra placements:', error);
    return { success: false, error: error.message };
  }
}

async function getStats(startDate: string, endDate: string, groupBy = 'date') {
  try {
    const data = await makeAdsterraRequest('stats.json', {
      start_date: startDate,
      finish_date: endDate,
      group_by: groupBy,
    });
    return { success: true, data: data.items || [], lastUpdate: data.dbLastUpdateTime };
  } catch (error) {
    console.error('Error fetching Adsterra stats:', error);
    return { success: false, error: error.message };
  }
}

async function processAdView(userId: string, placementId?: string) {
  try {
    const { data, error } = await supabase.rpc('process_ad_view', {
      p_user_id: userId,
      p_placement_id: placementId
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error processing ad view:', error);
    return { success: false, error: error.message };
  }
}

async function getAdProgress(userId: string) {
  try {
    const { data, error } = await supabase
      .from('ad_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return { 
      success: true, 
      data: data || { 
        views_today: 0, 
        total_credits_earned: 0, 
        last_view_date: new Date().toISOString().split('T')[0] 
      } 
    };
  } catch (error) {
    console.error('Error fetching ad progress:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to ensure HTTPS URLs
function toHttps(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  if (url.includes('://')) return null; // Other protocols not allowed
  return `https://${url}`;
}

async function getRandomAdVideo() {
  try {
    // For now, always use demo HTTPS videos to avoid Mixed Content errors
    // TODO: Implement proper HTTPS Adsterra integration later
    console.log('Using demo video to avoid Mixed Content errors');
    
    // Always use demo videos for HTTPS compatibility
    const randomIndex = Math.floor(Math.random() * SHORT_AD_VIDEOS.length);
    const selectedVideo = SHORT_AD_VIDEOS[randomIndex];
    
    return {
      success: true,
      data: {
        url: selectedVideo.url,
        duration: selectedVideo.duration,
        title: selectedVideo.title,
        thumbnail: selectedVideo.thumbnail,
        placementId: `demo_${randomIndex + 1}`,
        adsterraIntegrated: false,
        type: 'video'
      }
    };
  } catch (error) {
    console.error('Error getting ad video:', error);
    // Fallback para vídeo padrão
    const fallbackVideo = SHORT_AD_VIDEOS[0];
    return {
      success: true,
      data: {
        url: fallbackVideo.url,
        duration: fallbackVideo.duration,
        title: fallbackVideo.title,
        thumbnail: fallbackVideo.thumbnail,
        placementId: 'fallback',
        adsterraIntegrated: false,
        type: 'video'
      }
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const userId = url.searchParams.get('user_id');

    console.log(`Adsterra Integration: ${req.method} ${path}`, { userId });

    switch (path) {
      case 'domains':
        const domains = await getDomains();
        return new Response(JSON.stringify(domains), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'placements':
        const placements = await getPlacements();
        return new Response(JSON.stringify(placements), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'stats':
        const startDate = url.searchParams.get('start_date') || new Date().toISOString().split('T')[0];
        const endDate = url.searchParams.get('end_date') || new Date().toISOString().split('T')[0];
        const groupBy = url.searchParams.get('group_by') || 'date';
        
        const stats = await getStats(startDate, endDate, groupBy);
        return new Response(JSON.stringify(stats), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'progress':
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'User ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const progress = await getAdProgress(userId);
        return new Response(JSON.stringify(progress), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'view':
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'User ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = await req.json();
        const placementId = body.placement_id;
        
        const viewResult = await processAdView(userId, placementId);
        return new Response(JSON.stringify(viewResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'video':
        const video = await getRandomAdVideo();
        return new Response(JSON.stringify(video), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ success: false, error: 'Endpoint not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Adsterra Integration Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});