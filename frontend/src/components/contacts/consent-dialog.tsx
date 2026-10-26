"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FilterSelect } from "@/components/inbox/filter-select";
import { api } from "@/lib/api";

export const CONSENT_LABELS: Record<string, string> = {
  email_marketing: "Email marketing",
  email_transactional: "Email (requested content)",
  messaging: "Messaging",
};

export function ConsentDialog({ contactId, onSaved }: { contactId: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("email_marketing");
  const [status, setStatus] = useState("granted");
  const [evidence, setEvidence] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await api.post(`contacts/${contactId}/consents`, { type, status, evidence });
      toast.success("Consent recorded");
      setOpen(false);
      setEvidence("");
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs" />}>
        <ShieldCheck className="size-3" /> Record consent
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record consent</DialogTitle>
          <DialogDescription>Consent records are append-only. Describe how and when consent was given or withdrawn.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <FilterSelect ariaLabel="Consent type" value={type} onChange={setType} className="w-full" options={Object.entries(CONSENT_LABELS).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <FilterSelect
              ariaLabel="Consent status"
              value={status}
              onChange={setStatus}
              className="w-full"
              options={[
                { value: "granted", label: "Granted" },
                { value: "revoked", label: "Revoked" },
              ]}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="evidence">Evidence</Label>
          <Textarea
            id="evidence"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="e.g. Signed up at our Nairobi pop-up event on 12 Oct, paper form #214"
            rows={3}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || evidence.trim().length < 5}>
            {pending && <Loader2 className="size-3.5 animate-spin" />} Save record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
