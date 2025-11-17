export const getPasswordStrength = (password) => {
  if (!password) return "";

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[\W]/.test(password)) score++;

  if (score <= 1) return "Lemah";
  if (score === 2 || score === 3) return "Sedang";
  if (score >= 4) return "Kuat";
};
