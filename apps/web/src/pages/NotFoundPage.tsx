import { FileQuestion } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/States';
import { useDocumentTitle } from '../lib/utils';

export function NotFoundPage({
  title = 'Página no encontrada',
  description = 'La dirección que has abierto no existe o ha cambiado.',
}: {
  title?: string;
  description?: string;
}) {
  useDocumentTitle(title);
  return (
    <EmptyState
      icon={<FileQuestion className="size-6" />}
      title={title}
      description={description}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink to="/" variant="secondary">
            Ir al panel
          </ButtonLink>
          <ButtonLink to="/incidencias">Ver incidencias</ButtonLink>
        </div>
      }
    />
  );
}
