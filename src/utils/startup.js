function validateRequiredEnv(env) {
  const required = ['BOT_TOKEN', 'MONGO_URI'];
  const errors = [];

  for (const key of required) {
    const value = env[key];
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
      continue;
    }

    if (typeof value === 'string' && value.startsWith('replace-with-your-')) {
      errors.push(`Environment variable ${key} is still set to a placeholder value.`);
    }
  }

  return errors;
}

module.exports = { validateRequiredEnv };
