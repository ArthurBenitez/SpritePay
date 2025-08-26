-- Add points field to sprites table
ALTER TABLE public.sprites ADD COLUMN points INTEGER;

-- Update sprites with correct prices (credits to buy) and points (points earned)
-- Current prices seem to be the points values, so we'll fix this

-- Lamine Yamal: Common rarity - 3 credits, 5 points
UPDATE public.sprites 
SET price = 3, points = 5 
WHERE name = 'Lamine Yamal';

-- Vinícius Jr: Rare rarity - 6 credits, 8 points  
UPDATE public.sprites 
SET price = 6, points = 8 
WHERE name = 'Vinícius Jr';

-- Robert Lewandowski: Rare rarity - 25 credits, 32 points
UPDATE public.sprites 
SET price = 25, points = 32 
WHERE name = 'Robert Lewandowski';

-- Erling Haaland: Epic rarity - 50 credits, 64 points
UPDATE public.sprites 
SET price = 50, points = 64 
WHERE name = 'Erling Haaland';

-- Kylian Mbappé: Epic rarity - 80 credits, 100 points
UPDATE public.sprites 
SET price = 80, points = 100 
WHERE name = 'Kylian Mbappé';

-- Neymar: Legendary rarity - 250 credits, 320 points
UPDATE public.sprites 
SET price = 250, points = 320 
WHERE name = 'Neymar';

-- Cristiano Ronaldo: Legendary rarity - 400 credits, 512 points
UPDATE public.sprites 
SET price = 400, points = 512 
WHERE name = 'Cristiano Ronaldo';

-- Lionel Messi: Legendary rarity - 3000 credits, 4096 points
UPDATE public.sprites 
SET price = 3000, points = 4096 
WHERE name = 'Lionel Messi';

-- Make points field NOT NULL after setting values
ALTER TABLE public.sprites ALTER COLUMN points SET NOT NULL;