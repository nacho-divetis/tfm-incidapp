import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '../../api/client';
import { api, attachmentUrl } from '../../api/endpoints';
import { invalidateIncidents } from '../../api/queries';
import type { Attachment, IncidentListItem } from '../../api/types';
import { useCurrentUser } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Card, CardHeader } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { formatBytes, formatDateTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import { ACCEPT_ATTR, validateAttachmentFile } from '../../lib/validation';

interface Props {
  incident: IncidentListItem;
  attachments: Attachment[];
  canAttach: boolean;
}

/** HU-09: adjuntos de la incidencia (subida con arrastrar y soltar, miniaturas y borrado). */
export function AttachmentsPanel({ incident, attachments, canAttach }: Props) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAttachment(incident.id, file),
  });

  const remove = useMutation({
    mutationFn: (a: Attachment) => api.deleteAttachment(a.id),
    onSuccess: async (_d, a) => {
      await invalidateIncidents(qc);
      toast.success(`Adjunto «${a.filename}» eliminado`);
      setToDelete(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setToDelete(null);
    },
  });

  /** Valida en cliente y sube los archivos uno a uno. */
  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    let ok = 0;
    for (const file of list) {
      const problem = validateAttachmentFile(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        await upload.mutateAsync(file);
        ok++;
      } catch (e) {
        toast.error(`«${file.name}»: ${errorMessage(e)}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    if (ok > 0) {
      await invalidateIncidents(qc);
      toast.success(ok === 1 ? 'Adjunto subido' : `${ok} adjuntos subidos`);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!canAttach) return;
    void handleFiles(e.dataTransfer.files);
  };

  // El borrado lo decide la API; aquí solo se muestra el botón a quien previsiblemente puede.
  const mayDelete = (a: Attachment) =>
    canAttach &&
    (user.role === 'ADMIN' || user.role === 'RESPONSABLE' || a.uploadedById === user.id);

  return (
    <Card>
      <CardHeader title={`Adjuntos (${attachments.length})`} />
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {canAttach && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors',
              dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50',
            )}
          >
            <Upload className="size-6 text-slate-400" aria-hidden="true" />
            <p className="text-slate-700">
              Arrastra archivos aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-blue-700 underline-offset-2 hover:underline"
              >
                selecciónalos
                <span className="sr-only"> (subir adjunto)</span>
              </button>
            </p>
            <p className="text-xs text-slate-500">JPG, PNG, WEBP o PDF · máximo 5 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => e.target.files && void handleFiles(e.target.files)}
            />
            {uploading.length > 0 && (
              <p role="status" className="flex items-center gap-2 text-xs text-blue-700">
                <Spinner size="sm" /> Subiendo {uploading.join(', ')}…
              </p>
            )}
          </div>
        )}

        {attachments.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Paperclip className="size-4" aria-hidden="true" />
            No hay archivos adjuntos.
          </p>
        ) : (
          <ul className="space-y-3">
            {attachments.map((a) => {
              const isImage = a.mimeType.startsWith('image/');
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
                >
                  <a
                    href={attachmentUrl(a.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 overflow-hidden rounded-md"
                    aria-label={`Abrir ${a.filename} en una pestaña nueva`}
                  >
                    {isImage ? (
                      <img
                        src={attachmentUrl(a.id)}
                        alt=""
                        loading="lazy"
                        className="size-14 bg-slate-100 object-cover"
                      />
                    ) : (
                      <span className="grid size-14 place-items-center bg-red-50 text-red-600">
                        <FileText className="size-6" aria-hidden="true" />
                      </span>
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <a
                      href={attachmentUrl(a.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-slate-900 hover:text-blue-800 hover:underline"
                    >
                      <span className="truncate">{a.filename}</span>
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="sr-only">(se abre en una pestaña nueva)</span>
                    </a>
                    <p className="truncate text-xs text-slate-500">
                      {formatBytes(a.size)} · {a.uploadedByName} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <a
                      href={attachmentUrl(a.id, true)}
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label={`Descargar ${a.filename}`}
                      title="Descargar"
                    >
                      <Download className="size-4" aria-hidden="true" />
                    </a>
                    {mayDelete(a) && (
                      <button
                        type="button"
                        onClick={() => setToDelete(a)}
                        className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Eliminar ${a.filename}`}
                        title="Eliminar"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Eliminar adjunto"
        size="sm"
        busy={remove.isPending}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setToDelete(null)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete)}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          ¿Seguro que quieres eliminar <strong className="break-all">{toDelete?.filename}</strong>?
          Quedará registrado en la actividad de la incidencia.
        </p>
      </Modal>
    </Card>
  );
}
