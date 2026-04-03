import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CompanyDocument } from '@/types';

interface UseCompanyDocumentsOptions {
  organizationId: string | null;
}

export function useCompanyDocuments({ organizationId }: UseCompanyDocumentsOptions) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('company_documents')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      // Compute status dynamically
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const enriched = (data ?? []).map((doc: CompanyDocument) => {
        if (!doc.valid_until) return { ...doc, status: 'Aktif' as const };
        const until = new Date(doc.valid_until);
        until.setHours(0, 0, 0, 0);
        const diff = Math.ceil((until.getTime() - today.getTime()) / 86400000);
        if (diff < 0) return { ...doc, status: 'Süresi Dolmuş' as const };
        if (diff <= 30) return { ...doc, status: 'Yaklaşan' as const };
        return { ...doc, status: 'Aktif' as const };
      });
      setDocuments(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const addDocument = useCallback(async (
    payload: Omit<CompanyDocument, 'id' | 'created_at' | 'updated_at' | 'status'>,
  ): Promise<{ error: string | null }> => {
    try {
      const { error: err } = await supabase
        .from('company_documents')
        .insert([{ ...payload, updated_at: new Date().toISOString() }]);
      if (err) throw err;
      await fetchDocuments();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Eklenemedi' };
    }
  }, [fetchDocuments]);

  const updateDocument = useCallback(async (
    id: string,
    payload: Partial<Omit<CompanyDocument, 'id' | 'created_at' | 'status'>>,
  ): Promise<{ error: string | null }> => {
    try {
      const { error: err } = await supabase
        .from('company_documents')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      await fetchDocuments();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Güncellenemedi' };
    }
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error: err } = await supabase
        .from('company_documents')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setDocuments(prev => prev.filter(d => d.id !== id));
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Silinemedi' };
    }
  }, []);

  const uploadFile = useCallback(async (
    file: File,
    organizationId: string,
  ): Promise<{ url: string | null; error: string | null }> => {
    try {
      const ext = file.name.split('.').pop();
      const path = `company-documents/${organizationId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('evraklar')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('evraklar').getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    } catch (e) {
      return { url: null, error: e instanceof Error ? e.message : 'Dosya yüklenemedi' };
    }
  }, []);

  return { documents, loading, error, fetchDocuments, addDocument, updateDocument, deleteDocument, uploadFile };
}
