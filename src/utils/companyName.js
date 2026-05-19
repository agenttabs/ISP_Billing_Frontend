import API from "../api/api";

export const DEFAULT_COMPANY_NAME = "DNS NETWORK";

export const normalizeCompanyName = (value) =>
  String(value || DEFAULT_COMPANY_NAME).trim() || DEFAULT_COMPANY_NAME;

export const fetchSystemCompanyName = async () => {
  const { data } = await API.get("/system-settings");
  return normalizeCompanyName(data?.CompanyName);
};
