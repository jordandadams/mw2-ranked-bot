import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import Discord from 'discord.js';

import dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = Discord;

const app = express();
const port = 3000;
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION'],
});

// Define the API endpoint to retrieve the player names
app.get('/players', (req, res) => {
    axios
        .get('https://www.wzranked.com/mw2/leaderboards/top250')
        .then((response) => {
            const $ = cheerio.load(response.data);
            const leaderboardData = $('script#__NEXT_DATA__').html();
            const leaderboard = JSON.parse(leaderboardData).props.pageProps.dataTop250.map((player) => {
                return {
                    gamertag: player.gamertag,
                    rankdense: player.rankdense,
                    skillrating: player.skillrating,
                };
            });
            //console.log('responseData => ', response.data);
            res.json(leaderboard);
        })
        .catch((error) => {
            console.log(error);
            res.status(500).send('Error retrieving player data');
        });
});

// Discord bot command for displaying leaderboard
let totalPages;

function createPaginationButtons(currentPage) {
    const row = new ActionRowBuilder();

    // Create a button for going to the previous page
    const previousButton = new ButtonBuilder()
        .setCustomId(`previous_${currentPage}`)
        .setLabel('Previous')
        .setStyle('Primary')
        .setDisabled(currentPage === 0);
    row.addComponents(previousButton);

    // Create a button for going to the next page
    const nextButton = new ButtonBuilder()
        .setCustomId(`next_${currentPage}`)
        .setLabel('Next')
        .setStyle('Primary')
        .setDisabled(currentPage === totalPages - 1);
    row.addComponents(nextButton);

    return row;
}

function getPageMessage(page, pageSize, leaderboard) {
    const start = page * pageSize;
    const end = start + pageSize;
    const leaderboardPage = leaderboard.slice(start, end);
    const leaderboardMessage = leaderboardPage
        .map((player) => {
            return `Rank: ${player.rankdense} | Gamertag: ${player.gamertag} | Skill Rating: ${player.skillrating}`;
        })
        .join('\n');
    const pageMessage = `${leaderboardMessage}`;

    const buttons = createPaginationButtons(page);

    return {
        leaderboardMessage: pageMessage,
        buttons: buttons,
    };
}


client.on('messageCreate', async (message) => {
    if (message.content.includes('/t250') && message.content.includes('ranks')) {
        message.channel.send('Retrieving leaderboard data...');

        axios
            .get('http://localhost:3000/players')
            .then(async (response) => {

                const leaderboard = response.data;
                leaderboard.sort((a, b) => a.rankdense - b.rankdense); // Sort by rankdense
                const pageSize = 10;
                const totalPages = Math.ceil(leaderboard.length / pageSize);

                let currentPage = 0;
                const { leaderboardMessage, buttons } = getPageMessage(currentPage, pageSize, leaderboard);
                const embed = new EmbedBuilder().setDescription(leaderboardMessage);

                const messageSent = await message.channel.send({
                    embeds: [embed],
                    components: [buttons],
                });

                const filter = (interaction) => {
                    if (interaction.user.id !== message.author.id) return false;
                    if (!interaction.isButton()) return false;
                    const [buttonAction, buttonPage] = interaction.customId.split('_');
                    if (!['previous', 'next'].includes(buttonAction)) return false;
                    if (buttonAction === 'previous' && currentPage === 0) return false;
                    if (buttonAction === 'next' && currentPage === totalPages - 1) return false;
                    return true;
                };

                const collector = messageSent.createMessageComponentCollector({
                    filter,
                    time: 60_000, // Collect for 1 minute
                });

                collector.on('collect', (interaction) => {
                    const [buttonAction, buttonPage] = interaction.customId.split('_');
                    currentPage = buttonAction === 'previous' ? currentPage - 1 : currentPage + 1;
                    const { leaderboardMessage, buttons } = getPageMessage(currentPage, pageSize, leaderboard);
                    const newEmbed = new EmbedBuilder().setDescription(leaderboardMessage);

                    interaction.update({
                        embeds: [newEmbed],
                        components: [buttons],
                    });
                });

                collector.on('end', () => {
                    const endButtons = createPaginationButtons(currentPage);
                    endButtons.components.forEach((button) => button.setDisabled(true));
                    messageSent.edit({ components: [endButtons] });
                });

            })
            .catch((error) => {
                console.log(error);
                message.channel.send('Error retrieving leaderboard data');
            });
    }
});


client.login(token);

app.listen(port, () => {
    console.log(`API listening at http://localhost:${port}`);
});
