import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import { readFileSync } from 'node:fs';
import type { Guild } from 'discord.js';

type cfg = {
	musicBotCmdChannel: string,
	logChannel: string,
	languageCode: string,
	keywords:{
		botTrigger: string,
		play: [string],
		pause: [string],
		resume: [string],
		stop: [string],
		skip: [string],
		title: [string],
		playlist: [string]
	}
};

let botConfig: cfg = JSON.parse(readFileSync('config.json', 'utf-8'));

export const deploy = async (guild: Guild) => {
	await guild.commands.set([
		{
			name: 'join',
			description: 'Joins the voice channel that you are in',
		},
		{
			name: 'record',
			description: 'Enables recording for a user',
			options: [
				{
					name: 'speaker',
					type: ApplicationCommandOptionType.User,
					description: 'The user to record',
					required: true,
				},
			],
		},
		{
			name: 'leave',
			description: 'Leave the voice channel',
		},
		{
			name: botConfig.keywords.botTrigger,
			description: 'Obsługuje komendy bota muzycznego',
			options: [
				{
					name: 'komenda',
					type: ApplicationCommandOptionType.String,
					description: 'komenda dla bota',
					required: true
				},
			],
		},
		{
			name: 'help',
			description: 'Pomoc',
			options: [
				{
					name: 'kategoria',
					type: ApplicationCommandOptionType.String,
					description: 'Kategoria pomocy',
					choices: [
						{
							name: 'odtwarzanie',
							value: 'play'
						},
						{
							name: 'pauzowanie',
							value: 'pause'
						},
						{
							name: 'wznawianie',
							value: 'resume'
						},
						{
							name: 'wyłączanie',
							value: 'stop'
						},
						{
							name: 'pomijanie',
							value: 'skip'
						}
					],
					required: true
				},
			],
		}
	]);
};
