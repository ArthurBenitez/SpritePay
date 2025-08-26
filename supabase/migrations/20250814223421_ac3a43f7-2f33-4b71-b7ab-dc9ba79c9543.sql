-- Delete all existing sprites first
DELETE FROM public.sprites;

-- Update price constraint to include new prices
ALTER TABLE public.sprites DROP CONSTRAINT sprites_price_check;

ALTER TABLE public.sprites ADD CONSTRAINT sprites_price_check 
CHECK (price = ANY (ARRAY[5, 8, 32, 64, 100, 320, 512, 4096]));

-- Insert football players
INSERT INTO public.sprites (name, image, price, rarity) VALUES
('Lamine Yamal', '/src/assets/yamal-cyberpunk.jpg', 5, 'common'),
('Vinícius Jr', '/src/assets/vinicius-cyberpunk.jpg', 8, 'rare'),
('Robert Lewandowski', '/src/assets/lewandowski-cyberpunk.jpg', 32, 'rare'),
('Erling Haaland', '/src/assets/haaland-cyberpunk.jpg', 64, 'epic'),
('Kylian Mbappé', '/src/assets/mbappe-cyberpunk.jpg', 100, 'epic'),
('Neymar', '/src/assets/neymar-cyberpunk.jpg', 320, 'legendary'),
('Cristiano Ronaldo', '/src/assets/ronaldo-cyberpunk.jpg', 512, 'legendary'),
('Lionel Messi', '/src/assets/messi-cyberpunk.jpg', 4096, 'legendary');