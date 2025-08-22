import { createWriteStream, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream';
import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice';
import type { User, Client } from 'discord.js';
import * as prism from 'prism-media';
import * as speech from '@google-cloud/speech';

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

function getDisplayName(userId: string, user?: User) {
	return user ? `${user.username}_${user.discriminator}` : userId;
}

export function createListeningStream(receiver: VoiceReceiver, userId: string, client: Client, user?: User) {
	const speechClient = new speech.SpeechClient();
	const opusStream = receiver.subscribe(userId, {
		end: {
			behavior: EndBehaviorType.AfterSilence,
			duration: 1000,
		},
	});

	const oggStream = new prism.opus.OggLogicalBitstream({
		opusHead: new prism.opus.OpusHead({
			channelCount: 2,
			sampleRate: 48000,
		}),
		pageSizeControl: {
			maxPackets: 10,
		},
	});

	const filename = `./recordings/${Date.now()}-${getDisplayName(userId, user)}.ogg`;

	const out = createWriteStream(filename);

	console.log(`👂 Started recording ${filename}`);

	pipeline(opusStream, oggStream, out, (err) => {
		if (err) {
			console.warn(`❌ Error recording file ${filename} - ${err.message}`);
		} else {
			console.log(`✅ Recorded ${filename}`);
			//weź nagrany plik
			const file = readFileSync(filename);
			const audioBytes = file.toString('base64');
			//config dla google stt
			const encoding = 'OGG_OPUS';
			const audio = {
				content: audioBytes
			};
			const config = {
				encoding: encoding as any,
				sampleRateHertz: 48000,
				languageCode: botConfig.languageCode,
				audioChannelCount: 2
			};
			//stwórz zapytanie
			const request = {
				audio: audio,
				config: config
			};
			speechClient.recognize(request).then(response => {
				//console.log(response[0].results);
				const transcription = response[0].results?.map(result => result.alternatives![0]!.transcript);
				console.log(transcription); //Wynik

				var cmd = "";
				
				let transcribedWords = transcription?.toString().split(' ');

				if(transcription?.length ?? 0 > 0){
					if(botConfig.logChannel != null && botConfig.logChannel != ""){
						client.channels.fetch(botConfig.logChannel).then(channel => { //weź kanał dla logów bota muzycznego
							if(channel?.isText()){ 
								channel.send(transcribedWords?.toString() ?? "Transkrypcja nie powiodła się");
							}
						});
					}

					for(let i = 0; i< transcribedWords!.length; i++){
						if(transcribedWords![i]?.toLowerCase() == botConfig.keywords.botTrigger){	//sprawdź czy bot jest wywoływany
							for(let j = i + 1; j < transcribedWords!.length; j++){
								for(let item of botConfig.keywords.play){	//	przeiteruj przez słowa kluczowe dla komendy play
									if(item == transcribedWords![j]?.toLowerCase()){	//sprawdź któroś z następnych słów równa się komendzie play
										cmd += "?play";

										for(let k = j + 1; k < transcribedWords!.length; k++){
											for(let item1 of botConfig.keywords.title){
												if(item1 == transcribedWords![k]?.toLowerCase()){	//sprawdź czy po komendzie play została wywołana komenda title
													for(let m = k + 1; m < transcribedWords!.length; m++){	//jeżeli tak to weź resztę słow i użyj jej jako tytułu piosenki do wyszukania
														cmd += " ";
														cmd += transcribedWords![m];
													}
													break;
												}
											}
										}

										for(let k = j + 1; k < transcribedWords!.length; k++){
											for(let item1 of botConfig.keywords.playlist){
												if(item1 == transcribedWords![k]?.toLowerCase()){ // jeżeli wywoałan była komenda playlist to weź następne słowo jako nazwę playlisty
													cmd += " playlist ";
													cmd += transcribedWords![k + 1];
													break;
												}
											}
										}

										if(cmd.length < 7){	//jeżeli poprzednie słowa kluczowe nie zostały znalezione to włącz domyślną playlistę
											cmd += " playlist Default";
										}
										break;
									}
								}
							}
							for(let j = i + 1; j < transcribedWords!.length; j++){
								for(let item of botConfig.keywords.skip){
									if(item == transcribedWords![j]?.toLowerCase()){
										cmd += "?skip";
										break;
									}
								}
							}
							for(let j = i + 1; j < transcribedWords!.length; j++){
								for(let item of botConfig.keywords.stop){
									if(item == transcribedWords![j]?.toLowerCase()){
										cmd += "?stop";
										break;
									}
								}
							}
							for(let j = i + 1; j < transcribedWords!.length; j++){
								for(let item of botConfig.keywords.pause){
									if(item == transcribedWords![j]?.toLowerCase()){
										cmd += "?pause";
										break;
									}
								}
							}
							for(let j = i + 1; j < transcribedWords!.length; j++){
								for(let item of botConfig.keywords.resume){
									if(item == transcribedWords![j]?.toLowerCase()){
										cmd += "?play";
										break;
									}
								}
							}
							if(cmd == "" || cmd.length < 1){
								client.channels.fetch(botConfig.logChannel).then(channel => { //weź kanał dla logów bota muzycznego
									if(channel?.isText()){ 
										channel.send("Bot został wywołany ale nie rozpoznał komendy");
									}
								});
							}
							break;
							
						}
					}
				}else{
					if(botConfig.logChannel != null && botConfig.logChannel != ""){
						client.channels.fetch(botConfig.logChannel).then(channel => {
							if(channel?.isText()){ 
								channel.send("Transkrypcja nie powiodła się");
							}
						});
					}
				}
				//console.log(cmd);
				if(cmd.length > 0){
					client.channels.fetch(botConfig.musicBotCmdChannel).then(channel => { //weź kanał dla komend bota muzycznego
					
						if(channel?.isText()){ 
							channel.send(cmd); //wyślij wiadomość
						}
					})
				}
			});
		}
	});
}
