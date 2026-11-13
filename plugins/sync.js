'use strict';

const githubSync = require('../lib/githubPluginSync');

module.exports = {
  command: 'sync',
  aliases: ['pluginsync', 'syncplugins'],
  category: 'owner',
  description: 'Configure and update remote GitHub plugins',
  ownerOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const say = async (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const action = String(args[0] || 'status').toLowerCase();

    try {
      if (action === 'repo') {
        const repoInput = args.slice(1).join(' ').trim();
        if (!repoInput) return say('Usage: .sync repo owner/repository\nExample: .sync repo Gimaa/GIMAA-MD-PLUGINS');
        const repo = githubSync.parseRepo(repoInput);
        const config = await githubSync.getConfig();
        config.repo = `${repo.owner}/${repo.repo}`;
        config.enabled = true;
        await githubSync.saveConfig(config);
        await say(`✅ GitHub plugin repository saved: ${config.repo}\nStarting first sync...`);
        const result = await githubSync.syncNow();
        return say(`✅ GitHub plugin sync complete\nRepository: ${result.repo}\nUpdated: ${result.downloaded}\nUnchanged: ${result.unchanged}\nTotal: ${result.total}\nAuto sync: every ${githubSync.formatInterval(config.intervalMs)}`);
      }

      if (action === 'every' || action === 'interval') {
        const value = args[1];
        if (!value) return say('Usage: .sync every 1d\nExamples: .sync every 6h | .sync every 30m | .sync every 2d');
        const config = await githubSync.getConfig();
        config.intervalMs = githubSync.parseInterval(value);
        config.enabled = true;
        await githubSync.saveConfig(config);
        return say(`✅ Automatic GitHub plugin sync set to every ${githubSync.formatInterval(config.intervalMs)}.`);
      }

      if (action === 'off' || action === 'disable') {
        const config = await githubSync.getConfig();
        config.enabled = false;
        await githubSync.saveConfig(config);
        return say('⏸️ Automatic GitHub plugin updates disabled. Manual .sync now still works.');
      }

      if (action === 'on' || action === 'enable') {
        const config = await githubSync.getConfig();
        config.enabled = true;
        await githubSync.saveConfig(config);
        return say(`✅ Automatic GitHub plugin updates enabled (every ${githubSync.formatInterval(config.intervalMs)}).`);
      }

      if (action === 'now' || action === 'update' || action === 'run') {
        await say('🔄 Checking GitHub for plugin updates...');
        const result = await githubSync.syncNow();
        return say(`✅ GitHub plugin sync complete\nRepository: ${result.repo}\nUpdated: ${result.downloaded}\nUnchanged: ${result.unchanged}\nTotal plugins: ${result.total}`);
      }

      if (action === 'branch') {
        const branch = String(args[1] || '').trim();
        if (!branch || !/^[A-Za-z0-9._/-]{1,100}$/.test(branch) || branch.includes('..')) {
          return say('Usage: .sync branch main');
        }
        const config = await githubSync.getConfig();
        config.branch = branch;
        await githubSync.saveConfig(config);
        return say(`✅ GitHub plugin branch set to: ${branch}`);
      }

      if (action === 'status' || action === 'help') {
        const s = await githubSync.status();
        const last = s.lastSync ? new Date(s.lastSync).toLocaleString('en-GB', { timeZone: process.env.TZ || 'Asia/Colombo' }) : 'Never';
        return say(
          `╭─「 GIMAA-MD GITHUB PLUGINS 」\n` +
          `│ Repository: ${s.repo || 'Not configured'}\n` +
          `│ Branch: ${s.branch}\n` +
          `│ Folder: ${s.folder}\n` +
          `│ Auto update: ${s.enabled ? 'ON' : 'OFF'}\n` +
          `│ Interval: ${githubSync.formatInterval(s.intervalMs)}\n` +
          `│ Last sync (this server): ${last}\n` +
          `│ Server: ${s.server}\n` +
          `╰────────────────────\n\n` +
          `Commands:\n` +
          `• .sync repo owner/repo\n` +
          `• .sync now\n` +
          `• .sync every 1d  (or 6h / 30m / 2d)\n` +
          `• .sync branch main\n` +
          `• .sync off / .sync on\n` +
          `• .sync status`
        );
      }

      return say('Unknown option. Use .sync status to see available commands.');
    } catch (error) {
      return say(`❌ GitHub plugin sync error: ${error.message}`);
    }
  }
};
