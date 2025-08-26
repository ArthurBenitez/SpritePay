-- Add UPDATE policy for notifications so users can mark them as read
CREATE POLICY "Users can update their own notifications read status" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);