import { useState, useEffect } from 'react';
import { Proposal, OrderProduct } from '../types';
import { PROPOSAL_DOC_FIELDS } from '../constants/proposalConfig';
import { toast } from 'sonner';

export interface ProposalFormFields {
  title: string;
  clientId: string;
  message: string;
  signature: string;
  expiresAt: string;
}

export interface AssignableUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export function useProposalForm(userId: string | undefined) {
  const savedSigKey = `service-operations-signature-${userId}`;

  const [form, setForm] = useState<ProposalFormFields>({
    title: '', clientId: '', message: '', signature: '', expiresAt: '',
  });
  const [proposalDocs, setProposalDocs] = useState<Record<string, string>>({});
  const [proposalProducts, setProposalProducts] = useState<OrderProduct[]>([]);
  const [productRawInputs, setProductRawInputs] = useState<Record<string, string>>({});
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AssignableUser[]>([]);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('token');
    fetch('/api/auth/users?assignable=all', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((users: any[]) => setAvailableUsers(users.map(u => ({
        id: u.uid, displayName: u.displayName, email: u.email, role: u.role,
      }))))
      .catch(() => {});
  }, [userId]);

  const resetForm = () => {
    const savedSig = localStorage.getItem(savedSigKey) ?? '';
    setForm({ title: '', clientId: '', message: '', signature: savedSig, expiresAt: '' });
    setProposalDocs({});
    setProposalProducts([]);
    setProductRawInputs({});
    setAssigneeIds([]);
  };

  const loadProposalToForm = (p: Proposal) => {
    setForm({
      title: p.title,
      clientId: p.clientId,
      message: p.message ?? '',
      signature: p.signature ?? '',
      expiresAt: p.expiresAt ? p.expiresAt.split('T')[0] : '',
    });
    const docs: Record<string, string> = {};
    for (const { field } of PROPOSAL_DOC_FIELDS) {
      const v = (p as any)[field];
      if (v) docs[field] = v;
    }
    setProposalDocs(docs);
    setProposalProducts(p.products ?? []);
    setProductRawInputs({});
    setAssigneeIds(p.assignees?.map(a => a.id) ?? []);
  };

  const handleDocFileUpload = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setProposalDocs(prev => ({ ...prev, [field]: `${file.name}$$$${reader.result as string}` }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearDocFile = (field: string) =>
    setProposalDocs(prev => { const n = { ...prev }; delete n[field]; return n; });

  const addProposalProduct = () =>
    setProposalProducts(prev => [...prev, { category: 'sales', name: '', unitCost: 0, quantity: 1, lineTotal: 0 }]);

  const updateProposalProduct = (idx: number, field: keyof OrderProduct, value: string | number) => {
    setProposalProducts(prev => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value } as OrderProduct;
      if (field === 'unitCost' || field === 'quantity') {
        const cost = field === 'unitCost' ? Number(value) : Number(item.unitCost);
        const qty = field === 'quantity' ? Math.max(1, Number(value)) : Number(item.quantity);
        item.unitCost = cost;
        item.quantity = qty;
        item.lineTotal = cost * qty;
      }
      next[idx] = item;
      return next;
    });
  };

  const handleProductNumericChange = (idx: number, field: 'unitCost' | 'quantity', raw: string) => {
    setProductRawInputs(prev => ({ ...prev, [`${idx}-${field}`]: raw }));
    const num = field === 'unitCost' ? (parseFloat(raw) || 0) : (parseInt(raw) || 1);
    updateProposalProduct(idx, field, num);
  };

  const handleProductNumericBlur = (idx: number, field: 'unitCost' | 'quantity') =>
    setProductRawInputs(prev => { const n = { ...prev }; delete n[`${idx}-${field}`]; return n; });

  const buildPayload = () => ({
    ...form,
    products: proposalProducts,
    expiresAt: form.expiresAt || null,
    assigneeIds,
    ...proposalDocs,
    // clear any fields the user removed
    ...Object.fromEntries(
      PROPOSAL_DOC_FIELDS
        .filter(({ field }) => !proposalDocs[field])
        .map(({ field }) => [field, null])
    ),
  });

  return {
    form, setForm,
    proposalDocs,
    proposalProducts, setProposalProducts,
    productRawInputs,
    assigneeIds, setAssigneeIds,
    availableUsers,
    savedSigKey,
    resetForm,
    loadProposalToForm,
    handleDocFileUpload,
    clearDocFile,
    addProposalProduct,
    updateProposalProduct,
    handleProductNumericChange,
    handleProductNumericBlur,
    buildPayload,
  };
}
