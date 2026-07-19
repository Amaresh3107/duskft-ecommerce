import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from '../../components/ui/sonner';
import { API, formatApiErrorDetail } from '../../lib/api';
import { adminAuthHeaders, useAdminAuth } from '../../context/AdminAuthContext';

const EMPTY_FORM = { question: '', answer: '', category: '', active: true };

export default function KnowledgeBase() {
  const { isAdmin } = useAdminAuth();
  const [entries, setEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadEntries = () => {
    fetch(`${API}/chatbot/kb?includeInactive=true`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setEntries)
      .catch(() => {});
  };

  const loadLogs = () => {
    fetch(`${API}/chatbot/logs`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setLogs)
      .catch(() => {});
  };

  useEffect(() => { loadEntries(); loadLogs(); }, []);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({ question: entry.question, answer: entry.answer, category: entry.category || '', active: entry.active });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API}/chatbot/kb/${editingId}` : `${API}/chatbot/kb`;
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success(editingId ? 'Entry updated' : 'Entry added');
      setDialogOpen(false);
      loadEntries();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleActive = async (entry) => {
    try {
      const res = await fetch(`${API}/chatbot/kb/${entry.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ active: !entry.active }),
      });
      if (!res.ok) throw new Error('Could not update entry.');
      loadEntries();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`${API}/chatbot/kb/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success('Entry deleted');
      loadEntries();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[#121826]">Knowledge Base</h1>
        <p className="mt-0.5 text-sm text-[#5E6A7D]">Q&A pairs the AI chatbot draws on, plus a log of what customers have asked.</p>
      </div>

      <Tabs defaultValue="kb">
        <TabsList>
          <TabsTrigger value="kb">Knowledge Base ({entries.length})</TabsTrigger>
          <TabsTrigger value="logs">Conversation Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="kb" className="space-y-4">
          <div className="flex justify-end"><Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Entry</Button></div>
          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="max-w-sm">
                      <p className="font-medium text-[#121826]">{entry.question}</p>
                      <p className="truncate text-xs text-[#5E6A7D]">{entry.answer}</p>
                    </TableCell>
                    <TableCell>{entry.category ? <Badge variant="secondary">{entry.category}</Badge> : '—'}</TableCell>
                    <TableCell><Switch checked={entry.active} onCheckedChange={() => toggleActive(entry)} /></TableCell>
                    <TableCell className="text-right">
                      <button onClick={() => openEdit(entry)} className="mr-3 text-[#5E6A7D] hover:text-[#121826]"><Pencil size={14} /></button>
                      {isAdmin && <button onClick={() => remove(entry.id)} className="text-[#5E6A7D] hover:text-red-500"><Trash2 size={14} /></button>}
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-[#5E6A7D]">No knowledge base entries yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-xs">{log.question}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-[#5E6A7D]">{log.answer}</TableCell>
                    <TableCell>
                      {log.lowConfidence ? <Badge variant="destructive">Low — gap</Badge> : <Badge variant="secondary">Confident</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-[#5E6A7D]">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-[#5E6A7D]">No conversations logged yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'Add Knowledge Base Entry'}</DialogTitle>
            <DialogDescription>This answer will be used by the AI chatbot to respond to matching customer questions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Question" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
            <Textarea placeholder="Answer" rows={4} value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} />
            <Input placeholder="Category (optional)" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <span className="text-sm text-[#5E6A7D]">Active</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
