function getFeatureKey(command) {
  if (command?.category === 'casino') return 'casino';
  if (command?.category === 'heist') return 'heist';
  if (command?.category === 'blackmarket') return 'blackmarket';
  return null;
}

function isRestrictedCategory(command) {
  return ['economy', 'casino', 'heist', 'blackmarket'].includes(command?.category);
}

function isCommandDisabled(guildData, command) {
  if (!guildData || !command) return false;
  return (guildData.disabledCommands || []).includes(command.name);
}

function getDisabledCommandReason(guildData, command) {
  const featureKey = getFeatureKey(command);
  if (featureKey && guildData?.features?.[featureKey] === false) {
    return `The ${featureKey} feature is disabled in this server.`;
  }

  if (isCommandDisabled(guildData, command)) {
    return `The \`${command.name}\` command is disabled in this server.`;
  }

  return null;
}

module.exports = {
  getFeatureKey,
  isRestrictedCategory,
  isCommandDisabled,
  getDisabledCommandReason,
};
