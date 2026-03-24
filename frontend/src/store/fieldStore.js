import { create } from "zustand"

const useFieldStore = create((set) => ({
  fields: [],
  activeField: null,

  setFields: (fields) => set({ fields }),
  addField: (field) => set((s) => ({ fields: [...s.fields, field] })),
  updateField: (updated) => set((s) => ({
    fields: s.fields.map((f) => f.id === updated.id ? updated : f)
  })),
  removeField: (id) => set((s) => ({
    fields: s.fields.filter((f) => f.id !== id),
    activeField: s.activeField?.id === id ? null : s.activeField
  })),
  setActiveField: (field) => set({ activeField: field }),
}))

export default useFieldStore