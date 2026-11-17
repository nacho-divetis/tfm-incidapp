import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { invalidateIncidents } from '../../api/queries';
import { Button } from '../../components/Button';
import { Field, Textarea } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { LIMITS } from '../../lib/validation';

/** HU-08: añadir un comentario a la incidencia. */
export function CommentForm({ incidentId }: { incidentId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (value: string) => api.comment(incidentId, value),
    onSuccess: async () => {
      setText('');
      await invalidateIncidents(qc);
      toast.success('Comentario añadido');
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) {
      setError('Escribe un comentario');
      return;
    }
    setError(null);
    mutation.mutate(value);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Field label="Nuevo comentario" error={error}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Intro envía el comentario.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(e);
          }}
          maxLength={LIMITS.commentMax}
          rows={3}
          placeholder="Escribe una actualización, una pregunta o una nota para el equipo…"
          disabled={mutation.isPending}
        />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {text.length > 0 ? `${text.length}/${LIMITS.commentMax}` : 'Ctrl + Intro para enviar'}
        </span>
        <Button
          type="submit"
          size="sm"
          loading={mutation.isPending}
          icon={<Send className="size-4" aria-hidden="true" />}
        >
          Comentar
        </Button>
      </div>
    </form>
  );
}
