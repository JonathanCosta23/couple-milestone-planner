CREATE POLICY "Users can delete own milestones"
ON public.milestones
FOR DELETE
USING (auth.uid() = user_id);