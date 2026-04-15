# Racket Developer Guide

A Discord economy bot with casino games, economy commands, heists, and a blackmarket trading system.

## Prerequisites

- **Node.js** 18 or higher
- **MongoDB** instance (local or Atlas)
- **Discord Bot Token** with required intents

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd racket

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# BOT_TOKEN=your-discord-bot-token
# MONGO_URI=your-mongodb-connection-string
```

## Running Locally

```bash
# Development mode (auto-reload on changes)
npm run dev

# Production mode
npm start
```

## Project Structure

```
racket/
├── src/
│   ├── index.js              # Bot entry point
│   ├── config.js             # Global constants
│   ├── commands/             # All bot commands
│   │   ├── admin/            # Server administration
│   │   ├── blackmarket/      # Player trading
│   │   ├── casino/          # Casino games
│   │   ├── config/           # Server setup
│   │   ├── dev/             # Developer commands
│   │   ├── economy/          # Economy commands
│   │   ├── heist/           # Heist mechanics
│   │   └── info/            # Information commands
│   ├── events/               # Discord event handlers
│   ├── handlers/             # Command & event loaders
│   ├── models/               # MongoDB schemas
│   └── utils/               # Utility functions
├── test/                     # Test suite
└── scripts/                 # Utility scripts
```

## Command Structure

Commands are modular and support both prefix (`.`) and slash (`/`) invocation.

```javascript
module.exports = {
  name: 'commandname',
  aliases: ['alias1', 'alias2'],
  description: 'What the command does',
  usage: '<required_arg> [optional_arg]',
  category: 'economy',
  guildOnly: true,
  slash: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('What the command does')
    .addStringOption((option) => option.setName('arg').setDescription('Description').setRequired(true)),

  async execute({ message, args, client, guildData }) {
    // Prefix command logic
  },

  async executeSlash({ interaction }) {
    // Slash command logic
  },
};
```

### Command Properties

| Property       | Required | Description                                      |
| -------------- | -------- | ------------------------------------------------ |
| `name`         | Yes      | Unique command identifier (lowercase, no spaces) |
| `aliases`      | No       | Alternative names for prefix commands            |
| `description`  | Yes      | Brief description for help commands              |
| `usage`        | No       | Argument format hint                             |
| `category`     | Yes      | Folder name under `commands/`                    |
| `guildOnly`    | No       | If true, only works in servers                   |
| `slash`        | No       | SlashCommandBuilder instance for `/` commands    |
| `execute`      | Yes\*    | Prefix command handler                           |
| `executeSlash` | No       | Slash command handler                            |

## Adding Commands

1. Create a new `.js` file in the appropriate category folder
2. Follow the command structure template above
3. The CommandHandler automatically loads all files

### Example: Adding a Simple Economy Command

```javascript
// src/commands/economy/daily.js
const { SlashCommandBuilder } = require('discord.js');
const { DAILY_AMOUNT, DAILY_COOLDOWN } = require('../../config.js');
const { getUser, hasCooldown, setCooldown } = require('../../utils/economy.js');

module.exports = {
  name: 'daily',
  description: 'Claim your daily reward',
  category: 'economy',
  slash: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward'),

  async execute({ message, client, guildData }) {
    const user = await getUser(message.author.id, message.guildId);

    if (hasCooldown(user, 'daily')) {
      const remaining = user.cooldowns.daily - Date.now();
      return message.reply(`Come back later! Wait ${Math.ceil(remaining / 60000)} minutes.`);
    }

    user.wallet += DAILY_AMOUNT;
    setCooldown(user, 'daily', DAILY_COOLDOWN);
    await user.save();

    message.reply(`You claimed ${DAILY_AMOUNT} raqs!`);
  },

  async executeSlash({ interaction }) {
    // Same logic, adapted for interaction
  },
};
```

## Database Collections

| Collection     | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `users`        | User profiles (wallet, bank, chips, stats, inventory) |
| `guilds`       | Server settings (prefix, features, cooldowns)         |
| `blackmarkets` | Marketplace listings for trading                      |
| `pendinggames` | In-progress game fund reservations                    |
| `auditlogs`    | Transaction history for auditing                      |
| `errorlogs`    | Error tracking with unique IDs                        |
| `crews`        | Heist crew management                                 |

## Testing

```bash
# Run all tests
npm test

# Expected output:
# PASS startup validation
# PASS config invariants
# PASS command registry
# PASS setup and balance
```

### Adding Tests

Create a new `.test.js` file in the `test/` directory:

```javascript
const { test, assert, mock } = require('./helpers');

test('my feature', () => {
  assert.equal(actual, expected, 'Failure message');
});
```

See `test/*.test.js` for examples.

## Linting & Formatting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

## Error Handling Pattern

```javascript
module.exports = {
  async execute({ message, args, client, guildData }) {
    try {
      // 1. Validate inputs
      if (invalidInput) {
        return message.reply({ embeds: [embed.error('Invalid input')], ephemeral: true });
      }

      // 2. Perform operation
      const result = await doSomething();

      // 3. Handle expected failures
      if (!result) {
        return message.reply({ embeds: [embed.warning('Not found')] });
      }

      // 4. Return success
      return message.reply({ embeds: [embed.success('Done!')] });
    } catch (error) {
      // Unexpected errors → global handler
      await logError(error, { command: this.name, userId, guildId }, client);
      return message.reply({ embeds: [buildUserErrorEmbed()], ephemeral: true });
    }
  },
};
```

## Utilities

| File                        | Purpose                      |
| --------------------------- | ---------------------------- |
| `src/utils/economy.js`      | Wallet/bank/chips management |
| `src/utils/embed.js`        | Embed builder helpers        |
| `src/utils/gameFunds.js`    | Fund reservation for games   |
| `src/utils/errorManager.js` | Error logging and tracking   |
| `src/utils/cache.js`        | In-memory caching            |
| `src/utils/cooldown.js`     | Cooldown management          |

## Configuration

Key constants in `src/config.js`:

| Constant                | Default | Description            |
| ----------------------- | ------- | ---------------------- |
| `DEFAULT_PREFIX`        | `.`     | Command prefix         |
| `DAILY_AMOUNT`          | 1000    | Daily reward           |
| `WORK_MIN` / `WORK_MAX` | 250-750 | Work command range     |
| `CASINO_MIN_BET`        | 100     | Minimum casino bet     |
| `CASINO_MAX_BET`        | 50000   | Maximum casino bet     |
| `RANK_THRESHOLDS`       | -       | Rank progression tiers |

## Common Tasks

### Reset a User's Economy

```javascript
// Via admin command
/economy @user reset
```

### Add Database Indexes

```bash
node scripts/add-indexes.js
```

### View Error Logs

Errors are stored in MongoDB `errorlogs` collection with unique IDs (format: `ERR-XXXXXXXX`). Use the error ID to look up details.
