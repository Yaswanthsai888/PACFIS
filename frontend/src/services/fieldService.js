import api from "./api"

export const getFields = () => api.get("/fields/")
export const createField = (data) => api.post("/fields/", data)
export const updateField = (id, data) => api.put(`/fields/${id}`, data)
export const deleteField = (id) => api.delete(`/fields/${id}`)