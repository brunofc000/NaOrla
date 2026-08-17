import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}