import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

export interface CrmTag {
  id: string;
  isp_id: string;
  name: string;
  color: string;
  created_at: string;
}

async function callCrmApi(payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("crm-api", {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export function useCrmTags() {
  const { ispId } = useActiveIsp();
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!ispId) return;
    setIsLoading(true);
    try {
      const data = await callCrmApi({ action: "fetch_tags", isp_id: ispId });
      setTags((data as CrmTag[]) || []);
    } catch (err: any) {
      console.error("❌ useCrmTags fetch:", err.message);
    }
    setIsLoading(false);
  }, [ispId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(
    async (name: string, color: string) => {
      if (!ispId) return;
      const data = await callCrmApi({
        action: "create_tag",
        isp_id: ispId,
        name,
        color,
      });
      setTags((prev) => {
        const exists = prev.find((t) => t.name === name);
        if (exists) return prev.map((t) => (t.name === name ? (data as CrmTag) : t));
        return [...prev, data as CrmTag];
      });
      return data;
    },
    [ispId]
  );

  const deleteTag = useCallback(
    async (tagId: string) => {
      if (!ispId) return;
      await callCrmApi({ action: "delete_tag", isp_id: ispId, tag_id: tagId });
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    },
    [ispId]
  );

  return { tags, isLoading, createTag, deleteTag, refetch: fetchTags };
}
