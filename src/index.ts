import { IntentsBitField, Partials, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { ActivityType } from 'discord-api-types/v10';
import { customId } from './utils/customId';
import { getPlayerInfo, getPlayerThumbnail } from 'noblox.js';
import ms from 'ms';
import DatastoreService from './utils/DatastoreService';
import MessagingService from './utils/MessagingService';

import 'dotenv/config';
import './utils/string.extensions';

interface ManageData {
    username: string;
    banned: false | { reason: string };
    userId: number;
    thumbnail?: string;
    warnings: string[];
}

function generateMessageData(data: ManageData) {
    return {
        embeds: [new EmbedBuilder()
            .setTitle(`Manage ${data.username}`)
            .setTimestamp()
            .setThumbnail(data.thumbnail ?? null)
            .setColor('Blue')
            .addFields([
                { name: 'Banned', value: data.banned ? `Yes - ${data.banned.reason}` : 'No' },
                { name: 'Warnings', value: `${data.warnings.length} warning(s)\n\n\`\`\`${data.warnings.length ? data.warnings.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None.'}\`\`\`` }
            ])],
        components: [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents([
                    new ButtonBuilder()
                        .setCustomId('kick')
                        .setLabel('Kick')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(data.banned ? 'unban' : 'ban')
                        .setLabel(data.banned ? 'Unban' : 'Ban')
                        .setStyle(data.banned ? ButtonStyle.Success : ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('kill')
                        .setLabel('Kill')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('add-warning')
                        .setLabel('Add Warning')
                        .setStyle(ButtonStyle.Secondary),
                ]),
            new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents([
                    new StringSelectMenuBuilder()
                        .setCustomId('remove-warning')
                        .setMaxValues(1)
                        .setMinValues(1)
                        .setDisabled(data.warnings.length ? false : true)
                        .setPlaceholder('Remove warning(s)...')
                        .addOptions(data.warnings.length ? data.warnings.map((c, i) => ({ label: `${i + 1}.`, description: `Reason: ${c}`, value: i.toString() })) : [{ label: 'placeholder', value: 'placeholder' }])
                ]),
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents([
                    new ButtonBuilder()
                        .setCustomId('cancel')
                        .setStyle(ButtonStyle.Danger)
                        .setLabel('End Prompt')
                ])
        ]
    };
}

const client = new Client({
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.DirectMessages, IntentsBitField.Flags.GuildMessageReactions],
});

client.on('ready', () => {
    console.log('Bot has logged in.');

    client.user?.setPresence({
        activities: [{
            name: 'bots',
            type: ActivityType.Watching
        }]
    });
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;

        if (cmd === 'ping') {
            const embed = new EmbedBuilder()
                .setTitle('Connection Statistics')
                .setColor('Blue')
                .setTimestamp()
                .addFields([
                    { name: 'Ping', value: `${client.ws.ping}ms` },
                    { name: 'Uptime', value: ms(client.uptime!, { long: true }) }
                ]);

            await interaction.reply({ embeds: [embed] });
        } else if (cmd === 'manage') {
            const userId = interaction.options.getInteger('user_id', true);

            const playerInfo = await getPlayerInfo(userId).catch(() => null);
            if (!playerInfo) return void interaction.reply({ ephemeral: true, content: 'User doesn\'t exist.' });

            const banDatastore = new DatastoreService('Bans');
            const warningDatastore = new DatastoreService('Warnings');
            const messagingService = new MessagingService();

            const banData = await banDatastore.getEntry<{ reason: string; }>(`user_${userId}`);
            const warnings = await warningDatastore.getEntry<string[]>(`user_${userId}`);

            const thumbnail = await getPlayerThumbnail(userId, '720x720', 'png', true, 'headshot').then(d => d[0]);

            const manageData: ManageData = {
                banned: banData ? banData : false,
                userId,
                username: playerInfo.username,
                thumbnail: thumbnail.imageUrl,
                warnings: warnings ?? [],
            };

            const msg = await interaction.reply({ ...generateMessageData(manageData) });

            const collector = msg.createMessageComponentCollector<ComponentType.Button | ComponentType.StringSelect>({
                filter: i => i.user.id === interaction.user.id,
                idle: 300000 * 2,
                time: 300000 * 2,
            });

            collector.on('collect', async collected => {
                if (collected.isButton()) {
                    if (collected.customId === 'cancel') {
                        await collected.update({ embeds: [], components: [], content: 'Cancelled prompt.' });
                        collector.stop();
                    } else if (collected.customId === 'kick') {
                        const modalId = customId('kick', interaction.user.id);
                        const modal = new ModalBuilder()
                            .setTitle('Kick User')
                            .setCustomId(modalId)
                            .addComponents([
                                new ActionRowBuilder<TextInputBuilder>()
                                    .addComponents([
                                        new TextInputBuilder()
                                            .setCustomId('reason')
                                            .setLabel('reason')
                                            .setPlaceholder('Reason for the kick')
                                            .setMaxLength(512)
                                            .setRequired(true)
                                            .setStyle(TextInputStyle.Paragraph)
                                    ])
                            ]);

                        await collected.showModal(modal);
                        const response = await collected.awaitModalSubmit({
                            time: 120000,
                            filter: i => i.customId === modalId && i.user.id === interaction.user.id,
                        }).catch(() => null);

                        if (!response) return;

                        await messagingService.publish('Discord', { action: 'kick', reason: response.fields.getTextInputValue('reason'), userId });

                        await response.deferUpdate();
                        await collected.followUp({ ephemeral: true, content: `Successfully kicked ${playerInfo.username} from the server.` });
                    } else if (collected.customId === 'ban') {
                        const modalId = customId('ban', interaction.user.id);
                        const modal = new ModalBuilder()
                            .setTitle('Ban User')
                            .setCustomId(modalId)
                            .addComponents([
                                new ActionRowBuilder<TextInputBuilder>()
                                    .addComponents([
                                        new TextInputBuilder()
                                            .setCustomId('reason')
                                            .setLabel('reason')
                                            .setPlaceholder('Reason for the ban')
                                            .setMaxLength(512)
                                            .setRequired(true)
                                            .setStyle(TextInputStyle.Paragraph)
                                    ])
                            ]);

                        await collected.showModal(modal);
                        const response = await collected.awaitModalSubmit({
                            time: 120000,
                            filter: i => i.customId === modalId && i.user.id === interaction.user.id,
                        }).catch(() => null);

                        if (!response) return;

                        await banDatastore.createEntry(`user_${userId}`, { reason: response.fields.getTextInputValue('reason') });
                        await messagingService.publish('Discord', { action: 'kick', reason: 'Banned.', userId });

                        manageData.banned = { reason: response.fields.getTextInputValue('reason') };

                        await response.deferUpdate();

                        await collected.editReply(generateMessageData(manageData));
                        await collected.followUp({ ephemeral: true, content: `Successfully banned ${playerInfo.username} from the game.` });
                    } else if (collected.customId === 'unban') {
                        await banDatastore.deleteEntry(`user_${userId}`);

                        manageData.banned = false;

                        await collected.reply({ ephemeral: true, content: `Successfully unbanned ${playerInfo.username} from the game.` });
                        await collected.message.edit(generateMessageData(manageData));
                    } else if (collected.customId === 'kill') {
                        await messagingService.publish('Discord', { action: 'kill', userId });

                        await collected.reply({ ephemeral: true, content: `Successfully killed ${playerInfo.username}.` });
                    } else if (collected.customId === 'add-warning') {
                        const modalId = customId('warn', interaction.user.id);
                        const modal = new ModalBuilder()
                            .setTitle('Warn User')
                            .setCustomId(modalId)
                            .addComponents([
                                new ActionRowBuilder<TextInputBuilder>()
                                    .addComponents([
                                        new TextInputBuilder()
                                            .setCustomId('reason')
                                            .setLabel('reason')
                                            .setPlaceholder('Reason for the warn')
                                            .setMaxLength(512)
                                            .setRequired(true)
                                            .setStyle(TextInputStyle.Paragraph)
                                    ])
                            ]);

                        await collected.showModal(modal);
                        const response = await collected.awaitModalSubmit({
                            time: 120000,
                            filter: i => i.customId === modalId && i.user.id === interaction.user.id,
                        }).catch(() => null);

                        if (!response) return;

                        manageData.warnings.push(response.fields.getTextInputValue('reason'));

                        await warningDatastore.createEntry(`user_${userId}`, manageData.warnings);
                        await messagingService.publish('DiscordWarning', { userId });

                        await response.deferUpdate();
                        await collected.editReply(generateMessageData(manageData));
                        await collected.followUp({ ephemeral: true, content: `Successfully kicked ${playerInfo.username} from the server.` });
                    }
                } else if (collected.isStringSelectMenu()) {
                    if (collected.customId === 'remove-warning') {
                        manageData.warnings.splice(Number(collected.values[0]), 1);

                        await warningDatastore.createEntry(`user_${userId}`, manageData.warnings);
                        await messagingService.publish('DiscordWarning', { userId });

                        await collected.reply({ ephemeral: true, content: 'Successfully removed the warning.' });
                        await collected.message.edit(generateMessageData(manageData));
                    }
                }
            });
        }
    }
});

process.on('uncaughtException', (e) => {
    console.error(e);
    process.exit(1);
});

process.on('unhandledRejection', e => {
    console.error(e);
    process.exit(1);
});

(async () => {
    await client.login(process.env.TOKEN);
})();
