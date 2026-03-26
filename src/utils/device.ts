export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem("mukti_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
    localStorage.setItem("mukti_device_id", deviceId);
  }
  return deviceId;
};

export const isSessionValid = (lastOtpDate?: Date | string): boolean => {
  if (!lastOtpDate) return false;
  const lastDate = typeof lastOtpDate === "string" ? new Date(lastOtpDate) : lastOtpDate;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return lastDate > thirtyDaysAgo;
};
