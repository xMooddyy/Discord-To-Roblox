import { REST, Routes } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { clientId } from '../../config.json';

import 'dotenv/config';

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the gateway and API latency.'),
    new SlashCommandBuilder()
        .setName('manage')
        .setDescription('Manage a Roblox user.')
        .addIntegerOption(option => option.setName('user_id').setDescription('The user id of the player.').setRequired(true))
];
const rest = new REST().setToken(process.env.TOKEN!);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        ) as any;

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();