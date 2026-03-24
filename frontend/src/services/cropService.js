import api from "./api"

export const getCrops = () => api.get("/crops/")
export const getCropForField = (fieldId) => api.get(`/crops/field/${fieldId}`)
export const assignCrop = (data) => api.post("/crops/", data)
export const deleteCrop = (cropId) => api.delete(`/crops/${cropId}`)