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
                    updatedAt: player.updated_at,
                    date: player.dt,
                    rank: player.rank,
                    rankDense: player.rankdense,
                    dRankDense: player.drankdense,
                    gamertag: player.gamertag,
                    skillrating: player.skillrating,
                    dSkillRating: player.dskillrating,
                    isPro: player.ispro,
                    sessionLive: player.sessionlive,
                    sessionEnd: player.sessionend,
                    sessionHours: player.sessionhours,
                    sessionMinutes: player.sessionminutes,
                    sessionWins: player.sessionwins,
                    sessionLosses: player.sessionlosses,
                    sessionSr: player.sessionsr,
                    winStreak: player.winstreak,
                    longestWinStreak: player.longestwinstreak
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
            return `Rank: ${player.rankDense} | Gamertag: ${player.gamertag} | Total SR: ${player.skillrating} | Today's SR +/-: ${player.dSkillRating > 0 ? '+' : ''}${player.dSkillRating}`;
        })
        .join('\n');
    const pageMessage = `${leaderboardMessage}`;

    const buttons = createPaginationButtons(page);

    return {
        leaderboardMessage: pageMessage,
        buttons: buttons,
    };
}

// Add the offlineDuration function
function offlineDuration(player) {
    if (!player.sessionLive) {
        const sessionEnd = new Date(player.sessionEnd);
        const currentTime = new Date();

        const timeDifference = currentTime - sessionEnd; // in milliseconds
        const minutes = Math.floor(timeDifference / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return { minutes, hours, days };
    } else {
        return null;
    }
}

function formatOfflineDuration(duration) {
    if (duration.days > 1) { // Check if the user has been offline for more than one day
        return "more than 1 day";
    } else if (duration.days === 1) {
        return "1 day";
    } else if (duration.hours > 0) {
        return `${duration.hours} hours`;
    } else {
        return `${duration.minutes} minutes`;
    }
}

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('/t250')) {
        let gamertag = message.content.split(' ')[1];
        if (!gamertag) {
            message.channel.send('Sorry, user not found in Top 250! Make sure to check spelling!');
            return;
        }

        message.channel.send(`Searching Top 250 leaderboards for ${gamertag}...`);

        axios
            .get('http://localhost:3000/players')
            .then(async (response) => {
                const leaderboard = response.data;
                const player = leaderboard.find((player) => player.gamertag.toLowerCase() === gamertag.toLowerCase());

                if (!player) {
                    message.channel.send(`Sorry, ${gamertag} is not in Top 250! Make sure to check spelling!`);
                    return;
                }

                const offlineDurationData = offlineDuration(player);
                const offlineMessage = offlineDurationData
                    ? `Offline for ${formatOfflineDuration(offlineDurationData)}`
                    : 'Playing';

                const timePlayedMessage = (player.sessionHours || player.sessionMinutes)
                    ? `${player.sessionHours}h ${player.sessionMinutes}m`
                    : 'Has not played today';

                const leaderboardMessage = `**Rank:** ${player.rankDense}\n**Gamertag:** ${player.gamertag}\n**Total SR:** ${player.skillrating}\n**Today's SR +/-:** ${player.dSkillRating > 0 ? '+' : ''}${player.dSkillRating}\n**Current Win Streak:** ${player.winStreak}\n\n**Last Session:**\n**Status**: ${offlineMessage}\n**Time Played**: ${timePlayedMessage}\n**SR**: ${player.sessionSr > 0 ? '+' : ''}${player.sessionSr}\n**Win/Loss**: ${player.sessionWins}/${player.sessionLosses}`;

                const embed = new EmbedBuilder()
                    .setTitle(`Found ${gamertag} in Top 250!`)
                    .setDescription(leaderboardMessage)
                    .setTimestamp()
                    .setColor('BLUE');

                message.channel.send({
                    embeds: [embed]
                });
            })


            .catch((error) => {
                console.log(error);
                message.channel.send('Error retrieving leaderboard data');
            });
    }
}
);


client.login(token);

app.listen(port, () => {
    console.log(`API listening at http://localhost:${port}`);
});
