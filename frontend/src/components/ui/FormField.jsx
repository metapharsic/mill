import React from 'react'

/**
 * FormField — label + input/select/textarea + required marker + inline error.
 *
 * Usage:
 *   <FormField label="Department" required error={errors.dept}>
 *     <select ...>...</select>
 *   </FormField>
 *
 *   <FormField label="Quantity" required hint="Enter numeric value" error={errors.qty}>
 *     <input type="number" ... />
 *   </FormField>
 */
export function FormField({ label, required, hint, error, children, style }) {
  const id = React.useId()
  // Clone child to inject id if it doesn't have one
  const child = React.Children.only(children)
  const cloned = React.cloneElement(child, {
    id: child.props.id || id,
    'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
    'aria-invalid': error ? 'true' : undefined,
    style: {
      ...child.props.style,
      borderColor: error ? '#dc2626' : undefined,
    },
  })

  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && (
        <label htmlFor={child.props.id || id} style={S.label}>
          {label}
          {required && (
            <span style={S.required} aria-hidden="true"> *</span>
          )}
        </label>
      )}
      {cloned}
      {hint && !error && (
        <div id={`${id}-hint`} style={S.hint}>{hint}</div>
      )}
      {error && (
        <div id={`${id}-err`} role="alert" style={S.error}>{error}</div>
      )}
    </div>
  )
}

const S = {
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#3f3f46',
    marginBottom: 6,
  },
  required: {
    color: '#dc2626',
    fontWeight: 700,
  },
  hint: {
    fontSize: 11.5,
    color: '#71717a',
    marginTop: 5,
  },
  error: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 5,
    fontWeight: 500,
  },
}
