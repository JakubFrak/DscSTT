import { entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, CommandInteraction, GuildMember, Snowflake } from 'discord.js';
import { createListeningStream } from './createListeningStream';
import { readFileSync } from 'node:fs';

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

async function join(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	await interaction.deferReply();
	if (!connection) {
		if (interaction.member instanceof GuildMember && interaction.member.voice.channel) {
			const channel = interaction.member.voice.channel;
			connection = joinVoiceChannel({
				channelId: channel.id,
				guildId: channel.guild.id,
				selfDeaf: false,
				selfMute: false,
				// @ts-expect-error Currently voice is built in mind with API v10 whereas discord.js v13 uses API v9.
				adapterCreator: channel.guild.voiceAdapterCreator,
			});
		} else {
			await interaction.followUp('Join a voice channel and then try that again!');
			return;
		}
	}

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 20e3);
		const receiver = connection.receiver;

		receiver.speaking.on('start', (userId) => {
			if (recordable.has(userId)) {
				createListeningStream(receiver, userId, client, client.users.cache.get(userId));
			}
		});
	} catch (error) {
		console.warn(error);
		await interaction.followUp('Failed to join voice channel within 20 seconds, please try again later!');
	}

	await interaction.followUp('Ready!');
}

async function record(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		const userId = interaction.options.get('speaker')!.value! as Snowflake;
		recordable.add(userId);

		const receiver = connection.receiver;
		if (connection.receiver.speaking.users.has(userId)) {
			createListeningStream(receiver, userId, client, client.users.cache.get(userId));
		}

		await interaction.reply({ ephemeral: true, content: 'Listening!' });

	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}
}

async function leave(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	_client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		connection.destroy();
		recordable.clear();
		await interaction.reply({ ephemeral: true, content: 'Left the channel!' });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Not playing in this server!' });
	}
}

async function botTrigger(
	interaction: CommandInteraction,
	_recordable: Set<Snowflake>,
	_client: Client,
	connection?: VoiceConnection
){
	if(connection){
		const args = interaction.options.get('komenda')!.value! as String
		let transcribedWords = args.split(' ');
		var cmd = ""

		for(let i = 0; i < transcribedWords!.length; i++){
			for(let item of botConfig.keywords.play){	//	przeiteruj przez słowa kluczowe dla komendy play
				if(item == transcribedWords![i]?.toLowerCase()){	//sprawdź któroś z następnych słów równa się komendzie play
					cmd += "?play";

					for(let j = i + 1; j < transcribedWords!.length; j++){
						for(let item1 of botConfig.keywords.title){
							if(item1 == transcribedWords![j]?.toLowerCase()){	//sprawdź czy po komendzie play została wywołana komenda title
								for(let k = j + 1; k < transcribedWords!.length; k++){	//jeżeli tak to weź resztę słow i użyj jej jako tytułu piosenki do wyszukania
									cmd += " ";
									cmd += transcribedWords![k];
									await interaction.reply({ ephemeral: true, content: "Rozpoznano argument \"tytuł\", wydano komendę odtwarzania utworu z youtube" });
								}
								break;
							}
						}
					}

					for(let j = i + 1; j < transcribedWords!.length; j++){
						for(let item1 of botConfig.keywords.playlist){
							if(item1 == transcribedWords![j]?.toLowerCase()){ // jeżeli wywoałan była komenda playlist to weź następne słowo jako nazwę playlisty
								cmd += " playlist ";
								console.log(transcribedWords![j + 1]);
								cmd += transcribedWords![j + 1];
								await interaction.reply({ ephemeral: true, content: "Rozpoznano argument \"playlista\", wydano komendę odtwarzania" });
								break;
							}
						}
					}

					for(let j = i + 1; j < transcribedWords!.length; j++){
						if(transcribedWords![j]?.includes('youtube.com/')){ // sprawdź czy podane słowo jest linkiem do youtube
							cmd += " ";
							cmd += transcribedWords![j];
							await interaction.reply({ ephemeral: true, content: "Rozpoznano link, odtwarzanie" });
							break;
						}
					}

					if(cmd.length < 7){	//jeżeli poprzednie słowa kluczowe nie zostały znalezione to włącz domyślną playlistę
						await interaction.reply({ ephemeral: true, content: "Rozpoznano jedynie argument \"graj\", odtwarzanie domyślnej playlisty" });
						cmd += " playlist Default";
					}
					break;
				}
			}
		}
		for(let i = 0; i < transcribedWords!.length; i++){
			for(let item of botConfig.keywords.skip){
				if(item == transcribedWords![i]?.toLowerCase()){
					cmd += "?skip";
					await interaction.reply({ ephemeral: true, content: "Pomijanie piosenki" });
					break;
				}
			}
		}
		for(let i = 0; i < transcribedWords!.length; i++){
			for(let item of botConfig.keywords.stop){
				if(item == transcribedWords![i]?.toLowerCase()){
					cmd += "?stop";
					await interaction.reply({ ephemeral: true, content: "Kończę odtwarzanie" });
					break;
				}
			}
		}
		for(let i = 0; i < transcribedWords!.length; i++){
			for(let item of botConfig.keywords.pause){
				if(item == transcribedWords![i]?.toLowerCase()){
					cmd += "?pause";
					await interaction.reply({ ephemeral: true, content: "Pauzuję odtwarzanie" });
					break;
				}
			}
		}
		for(let i = 0; i < transcribedWords!.length; i++){
			for(let item of botConfig.keywords.resume){
				if(item == transcribedWords![i]?.toLowerCase()){
					cmd += "?play";
					await interaction.reply({ ephemeral: true, content: "Próbuję wznowić odtwarzanie (jeżeli nie ma zapauzowanej piosenki ta interakcja nie zadziała)" });
					break;
				}
			}
		}
		if(cmd == "" || cmd.length < 1){
			await interaction.reply({ ephemeral: true, content: "Bot został wywołany ale nie rozpoznał komendy" });
		}
		if(cmd.length > 0){
			_client.channels.fetch(botConfig.musicBotCmdChannel).then(channel => { //weź kanał dla komend bota muzycznego
				if(channel?.isText()){ 
					channel.send(cmd); //wyślij wiadomość
				}
			})
		}
	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}
}

async function help(
	interaction: CommandInteraction,
	_recordable: Set<Snowflake>,
	_client: Client,
	_connection?: VoiceConnection,
) {
	var msg = "";
	const args = interaction.options.get('kategoria')!.value! as String
	switch(args){
		case 'play':
			msg += "Odtwarzanie muzyki\n";
			msg += "botTrigger + play - bot wyda polecenie odtwarzania playlisty o nazwie Default\n"
			msg += "botTrigger + play + playlist + nazwaPlaylisty - bot wyda polecenie odtworzenia playlisty o podanej nazwie\n"
			msg += "botTrigger + play + title + nazwaUtowru - bot wyda polecenie odtworzenia pierwszego wyniku z wyszukiwania nazwy utworu w sesrwisie youtube\n"
			msg += "botTrigger + play + linkYoutube - bot wyda polecenie odtworzenia utworu z podanego linku do serwisu youtube (działa tylko jako komenda tekstowa)\n"
			msg += "Przy wydawaniu komend tekstowych słowa kluczowe powinny być oddzielone spacją\n"
			msg += "Playlisty należy utworzyć w folderze playlists według poradnika ze strony bota muzycznego https://jmusicbot.com/playlists/#local-playlists \n"
			msg += "Dostępne słowa kluczowe:\n"
			msg += "botTrigger: " + botConfig.keywords.botTrigger
			msg += "\nplay: "
			for(let item of botConfig.keywords.play){
				msg += item + " ";
			}
			msg += "\nplaylist: "
			for(let item of botConfig.keywords.playlist){
				msg += item + " ";
			}
			msg += "\ntitle: "
			for(let item of botConfig.keywords.title){
				msg += item + " ";
			}
			break;
		case 'pause':
			msg += "Pauzowanie muzyki\n"
			msg += "botTrigger + pause - bot wyda polecenie wstrzymania odtwarzania\n"
			msg += "Dostępne słowa kluczowe:\n"
			msg += "botTrigger: " + botConfig.keywords.botTrigger
			msg += "\npause: "
			for(let item of botConfig.keywords.pause){
				msg += item + " ";
			}
			break;
		case 'resume':
			msg += "Wznawianie muzyki\n"
			msg += "botTrigger + resume - bot wyda polecenie wznowienia odtwarzania (zadziała jeżeli zostało ono wcześniej wstrzymane)\n"
			msg += "Dostępne słowa kluczowe:\n"
			msg += "botTrigger: " + botConfig.keywords.botTrigger
			msg += "\nresume: "
			for(let item of botConfig.keywords.resume){
				msg += item + " ";
			}
			break;
		case 'stop':
			msg += "Kończenie odtwarzania\n"
			msg += "botTrigger + stop - bot wyda polecenie zakończenia odtwarzania\n"
			msg += "Dostępne słowa kluczowe:\n"
			msg += "botTrigger: " + botConfig.keywords.botTrigger
			msg += "\nstop: "
			for(let item of botConfig.keywords.stop){
				msg += item + " ";
			}
			break;
		case 'skip':
			msg += "Pominięcie piosenki\n"
			msg += "botTrigger + skip - bot wyda polecenie pominięcia odtwarzanego utworu (zadziała jeżeli odtwarzana jest playlista)\n"
			msg += "Dostępne słowa kluczowe:\n"
			msg += "botTrigger: " + botConfig.keywords.botTrigger
			msg += "\nskip: "
			for(let item of botConfig.keywords.skip){
				msg += item + " ";
			}
			break;
		default:
			msg += "Niepoprawna komenda, wybierz jedną z podanych opcji"
			break;
	}
	await interaction.reply({ ephemeral: true, content: msg });
}

export const interactionHandlers = new Map<
	string,
	(
		interaction: CommandInteraction,
		recordable: Set<Snowflake>,
		client: Client,
		connection?: VoiceConnection,
	) => Promise<void>
>();
interactionHandlers.set('join', join);
interactionHandlers.set('record', record);
interactionHandlers.set('leave', leave);
interactionHandlers.set(botConfig.keywords.botTrigger, botTrigger);
interactionHandlers.set('help', help)
