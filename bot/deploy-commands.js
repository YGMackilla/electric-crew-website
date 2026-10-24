// Registers the /event slash commands with your server. Run once (and again if you edit commands):  npm run deploy
import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const commands = [
  new SlashCommandBuilder()
    .setName("event")
    .setDescription("Electric Crew DJ set-slot bookings")
    .addSubcommand(s => s.setName("create").setDescription("Create a new event and open DJ slots for booking"))
    .addSubcommand(s => s.setName("list").setDescription("Show upcoming events and how many slots are open"))
    .addSubcommand(s =>
      s.setName("cancel").setDescription("Cancel an event (organizers only)")
        .addStringOption(o => o.setName("event_id").setDescription("Event ID shown in the event post footer").setRequired(true)))
    .addSubcommand(s =>
      s.setName("unbook").setDescription("Remove a DJ from a slot (organizers only)")
        .addStringOption(o => o.setName("event_id").setDescription("Event ID from the post footer").setRequired(true))
        .addIntegerOption(o => o.setName("slot").setDescription("Slot number").setRequired(true))),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands });
console.log("Slash commands registered.");
