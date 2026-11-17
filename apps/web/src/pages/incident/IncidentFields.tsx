import { PRIORITIES, type Department, type IncidentType } from '../../api/types';
import { Field, Input, Select, Textarea } from '../../components/Field';
import { PRIORITY_LABEL } from '../../lib/labels';
import { LIMITS, type FormErrors, type IncidentFormValues } from '../../lib/validation';

interface IncidentFieldsProps {
  values: IncidentFormValues;
  errors: FormErrors<IncidentFormValues>;
  onChange: (changes: Partial<IncidentFormValues>) => void;
  types: IncidentType[];
  /** Departamentos seleccionables; si es `null` el campo no se muestra. */
  departments: Department[] | null;
  departmentHint?: string;
  disabled?: boolean;
}

/** Campos comunes del formulario de alta y de edición de incidencias. */
export function IncidentFields({
  values,
  errors,
  onChange,
  types,
  departments,
  departmentHint,
  disabled,
}: IncidentFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Título"
        required
        error={errors.title}
        hint={`Resumen breve (${LIMITS.titleMin}–${LIMITS.titleMax} caracteres)`}
        className="sm:col-span-2"
      >
        <Input
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={LIMITS.titleMax}
          disabled={disabled}
          placeholder="Ej.: Palé dañado en la recepción del pedido 4512"
        />
      </Field>

      <Field
        label="Descripción"
        required
        error={errors.description}
        hint={`${values.description.trim().length}/${LIMITS.descriptionMax} caracteres (mínimo ${LIMITS.descriptionMin})`}
        className="sm:col-span-2"
      >
        <Textarea
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={LIMITS.descriptionMax}
          rows={6}
          disabled={disabled}
          placeholder="Qué ha pasado, dónde, a quién afecta y qué se ha hecho hasta ahora."
        />
      </Field>

      <Field label="Tipo" required error={errors.typeId}>
        <Select
          value={values.typeId}
          onChange={(e) => onChange({ typeId: e.target.value })}
          disabled={disabled}
        >
          <option value="">Selecciona un tipo…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Prioridad" required error={errors.priority}>
        <Select
          value={values.priority}
          onChange={(e) => onChange({ priority: e.target.value })}
          disabled={disabled}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </Field>

      {departments && (
        <Field label="Departamento" required error={errors.departmentId} hint={departmentHint}>
          <Select
            value={values.departmentId}
            onChange={(e) => onChange({ departmentId: e.target.value })}
            disabled={disabled || departments.length === 0}
          >
            {!values.departmentId && <option value="">Selecciona un departamento…</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label="Fecha objetivo"
        error={errors.dueDate}
        hint="Opcional. Fecha límite para resolverla."
      >
        <Input
          type="date"
          value={values.dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          disabled={disabled}
        />
      </Field>

      <Field
        label="Tercero implicado"
        error={errors.thirdParty}
        hint="Opcional. Proveedor, cliente o transportista."
        className={departments ? 'sm:col-span-2' : undefined}
      >
        <Input
          value={values.thirdParty}
          onChange={(e) => onChange({ thirdParty: e.target.value })}
          maxLength={LIMITS.thirdPartyMax}
          disabled={disabled}
          placeholder="Ej.: Transportes Rápidos S.L."
        />
      </Field>
    </div>
  );
}
