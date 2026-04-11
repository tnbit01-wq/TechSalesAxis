export const PERSONAL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "me.com",
  "msn.com",
  "live.com",
  "aol.com",
  "zoho.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "rediffmail.com",
  "rocketmail.com",
  "tutanota.com",
  "fastmail.com",
  "hushmail.com",
];

export const isPersonalEmail = (email: string): boolean => {
  const domain = email.split("@")[1]?.toLowerCase();
  return PERSONAL_DOMAINS.includes(domain);
};

export const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const extractNameFromEmail = (email: string): string => {
  const prefix = email.split("@")[0];
  
  // Extract only alphabetic characters
  const letters = prefix.replace(/[^a-zA-Z]/g, "");
  
  if (!letters) {
    return "User";
  }
  
  // Split by dots, underscores, or hyphens in the original prefix
  const parts = prefix
    .split(/[._\-]+/)
    .map(part => part.replace(/[^a-zA-Z]/g, "")) // Remove numbers/special chars from each part
    .filter(part => part.length > 0);
  
  if (parts.length === 0) {
    return "User";
  }
  
  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};
