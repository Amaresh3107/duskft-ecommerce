import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { toast } from '../components/ui/sonner';
import { API, getAuthHeaders, formatApiErrorDetail } from '../lib/api';
import { KB_ADMIN } from '../constants/testIds';

const EMPTY_FORM = { question: '', answer: '', category: '', active: true };

function LoginForm({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, accountType: 'staff' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      localStorage.setItem('kb_admin_token', data.token);
      localStorage.setItem('kb_admin_role', data.user.role);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B101A] px-4">
      <form onSubmit={submit} className="font-heading w-full max-w-sm rounded-lg border border-white/10 bg-[#121826] p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Knowledge Base Admin</h1>
        <p className="mt-1 text-sm text-white/50">Sign in with your Admin or Staff account.</p>
        <div className="mt-6 space-y-3">
          <Input data-testid={KB_ADMIN.loginEmailInput} type="email" placeholder="Email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 text-white border-white/10" />
          <Input data-testid={KB_ADMIN.loginPasswordInput} type="password" placeholder="Password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required className="bg-white/5 text-white border-white/10" />
        </div>
        {error && <p data-testid={KB_ADMIN.loginError} className="mt-3 text-sm text-red-400">{error}</p>}
        <Button data-testid={KB_ADMIN.loginSubmitButton} type="submit" disabled={loading}
                className="mt-5 w-full rounded-md bg-[#FF4500] text-white hover:bg-[#FF4500]/90">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}

export default function KnowledgeBaseAdmin() {
  const [token, setToken] = useState(localStorage.getItem('kb_admin_token'));
  const [entries, setEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadEntries = useCallback(async () => {
    const res = await fetch(`${API}/chatbot/kb?includeInactive=true`, { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    if (res.ok) setEntries(await res.json());
  }, []);

  const loadLogs = useCallback(async () => {
    const res = await fetch(`${API}/chatbot/logs`, { headers: getAuthHeaders() });
    if (res.status === 401) return logout();
    if (res.ok) setLogs(await res.json());
  }, []);

  useEffect(() => {
    if (token) {
      loadEntries();
      loadLogs();
    }
  }, [token, loadEntries, loadLogs]);

  if (!token) return <LoginForm onLoggedIn={() => setToken(localStorage.getItem('kb_admin_token'))} />;

  const logout = () => {
    localStorage.removeItem('kb_admin_token');
    setToken(null);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

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
        method, headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(form),
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
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
      const res = await fetch(`${API}/chatbot/kb/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
      toast.success('Entry deleted');
      loadEntries();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="font-heading min-h-screen bg-[#F9F8F6] p-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Admin Panel — Preview</p>
            <h1 className="mt-1 text-2xl font-bold text-[#121826]">Chatbot Knowledge Base</h1>
          </div>
          <Button data-testid={KB_ADMIN.logoutButton} variant="outline" onClick={logout} className="gap-2 rounded-none border-slate-300">
            <LogOut size={16} /> Logout
          </Button>
        </div>

        <Tabs defaultValue="kb" className="mt-8">
          <TabsList className="rounded-none border border-slate-200 bg-white p-1">
            <TabsTrigger data-testid={KB_ADMIN.kbTab} value="kb" className="rounded-none">Knowledge Base ({entries.length})</TabsTrigger>
            <TabsTrigger data-testid={KB_ADMIN.logsTab} value="logs" className="rounded-none">Conversation Logs ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="kb" className="mt-4">
            <div className="mb-3 flex justify-end">
              <Button data-testid={KB_ADMIN.addButton} onClick={openAdd} className="gap-2 rounded-none bg-[#0B132B] text-white hover:bg-[#0B132B]/90">
                <Plus size={16} /> Add Entry
              </Button>
            </div>
            <div className="border border-slate-200 bg-white">
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
                  {entries.map((entry, i) => (
                    <TableRow key={entry.id} data-testid={KB_ADMIN.row(i)}>
                      <TableCell className="max-w-sm">
                        <p className="font-medium text-[#121826]">{entry.question}</p>
                        <p className="truncate text-xs text-[#5E6A7D]">{entry.answer}</p>
                      </TableCell>
                      <TableCell>{entry.category ? <Badge variant="secondary" className="rounded-none">{entry.category}</Badge> : '—'}</TableCell>
                      <TableCell>
                        <Switch data-testid={KB_ADMIN.activeSwitch(i)} checked={entry.active} onCheckedChange={() => toggleActive(entry)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button data-testid={KB_ADMIN.editButton(i)} variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                          <Pencil size={15} />
                        </Button>
                        <Button data-testid={KB_ADMIN.deleteButton(i)} variant="ghost" size="icon" onClick={() => remove(entry.id)}>
                          <Trash2 size={15} className="text-red-500" />
                        </Button>
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

          <TabsContent value="logs" className="mt-4">
            <div className="border border-slate-200 bg-white">
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
                  {logs.map((log, i) => (
                    <TableRow key={log.id} data-testid={KB_ADMIN.logRow(i)}>
                      <TableCell className="max-w-xs">{log.question}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-[#5E6A7D]">{log.answer}</TableCell>
                      <TableCell>
                        {log.lowConfidence ? (
                          <Badge variant="destructive" className="rounded-none">Low — gap</Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-none">Confident</Badge>
                        )}
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid={KB_ADMIN.dialog} className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'Add Knowledge Base Entry'}</DialogTitle>
            <DialogDescription>This answer will be used by the AI chatbot to respond to matching customer questions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input data-testid={KB_ADMIN.questionInput} placeholder="Question" value={form.question}
                   onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
            <Textarea data-testid={KB_ADMIN.answerInput} placeholder="Answer" rows={4} value={form.answer}
                      onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} />
            <Input data-testid={KB_ADMIN.categoryInput} placeholder="Category (optional)" value={form.category}
                   onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <span className="text-sm text-[#5E6A7D]">Active</span>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid={KB_ADMIN.cancelButton} variant="outline" className="rounded-none" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button data-testid={KB_ADMIN.saveButton} className="rounded-none bg-[#0B132B] text-white hover:bg-[#0B132B]/90" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
